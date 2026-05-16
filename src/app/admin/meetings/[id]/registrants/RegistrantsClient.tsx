'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { Meeting, MeetingRegistrant } from '@/lib/types';
import { format } from 'date-fns';
import { 
    Users, ArrowLeft, CheckCircle2, Clock, Download, Mail, Search,
    UserCheck, ClipboardCheck, Calendar, AlertCircle, Loader2,
    MoreHorizontal, Check, X, Trash2, Plus, UsersRound, Send
} from 'lucide-react';
import Link from 'next/link';

import { toggleRegistrantAttendance } from '@/app/actions/meeting-attendance-actions';
import { 
    deleteRegistrantAction, 
    updateRegistrantStatusAction, 
    sendRegistrantJoinLinkAction,
    adminRegisterParticipantAction
} from '@/app/actions/meeting-registrants-actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
    DropdownMenuSeparator, DropdownMenuTrigger 
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

export default function RegistrantsClient({ meetingId }: { meetingId: string }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for toggling individual attendance
  const [isToggling, setIsToggling] = useState<Record<string, boolean>>({});
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Actions state
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [registrantToDelete, setRegistrantToDelete] = useState<MeetingRegistrant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Manual Registration state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '' });

  // Fetch Meeting
  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);
  
  const { data: meeting, isLoading: isLoadingMeeting, error: meetingError } = useDoc<Meeting>(meetingDocRef);

  useSetBreadcrumb(meeting?.entityName, `/admin/meetings/${meetingId}/registrants`);

  // Fetch Registrants
  const registrantsColRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return query(collection(firestore, `meetings/${meetingId}/registrants`), orderBy('registeredAt', 'desc'));
  }, [firestore, meetingId]);

  const { data: registrants, isLoading: isLoadingRegistrants, error: registrantsError } = useCollection<MeetingRegistrant>(registrantsColRef);

  // Derived Stats
  const stats = useMemo(() => {
    if (!registrants) return { total: 0, attended: 0, pending: 0, attendanceRate: 0 };
    const total = registrants.length;
    const attended = registrants.filter(r => r.status === 'attended').length;
    const pending = total - attended;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { total, attended, pending, attendanceRate };
  }, [registrants]);

  // Filtered List
  const filteredRegistrants = useMemo(() => {
    if (!registrants) return [];
    if (!searchQuery.trim()) return registrants;
    const lowerQuery = searchQuery.toLowerCase();
    return registrants.filter(r => {
        const nameMatch = r.name?.toLowerCase().includes(lowerQuery) || false;
        const emailMatch = r.email?.toLowerCase().includes(lowerQuery) || false;
        return nameMatch || emailMatch;
    });
  }, [registrants, searchQuery]);

  // Handle individual toggle attendance
  const toggleAttendance = async (registrant: MeetingRegistrant) => {
    const newStatus = registrant.status === 'attended' ? 'registered' : 'attended';
    setIsToggling(prev => ({ ...prev, [registrant.id]: true }));
    try {
        const result = await toggleRegistrantAttendance(meetingId, registrant.id, newStatus === 'attended');
        if (!result.success) throw new Error(result.error);
        toast({ title: 'Status Updated', description: `${registrant.name}'s attendance status updated.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update failed', description: e.message });
    } finally {
        setIsToggling(prev => ({ ...prev, [registrant.id]: false }));
    }
  };

  // Handle individual status updates (Approve / Cancel)
  const handleUpdateStatus = async (registrant: MeetingRegistrant, status: 'approved' | 'cancelled') => {
    try {
      const result = await updateRegistrantStatusAction(meetingId, registrant.id, status);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Status Updated', description: `Registrant has been ${status}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Handle individual deletion
  const handleDelete = async () => {
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

  // Handle individual sending link
  const handleSendLink = async (registrant: MeetingRegistrant) => {
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
    
    const selectedRegistrants = registrants!.filter(r => selectedIds.has(r.id));
    
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

  // Manual Registration
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
      toast({ title: 'Success', description: 'Registrant manually added and approved.' });
      setIsRegisterOpen(false);
      setRegForm({ name: '', email: '', phone: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Registration Failed', description: error.message });
    } finally {
      setIsRegistering(false);
    }
  };

  // Checkbox logic
  const toggleAll = () => {
    if (selectedIds.size === filteredRegistrants.length && filteredRegistrants.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRegistrants.map(r => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleExportCSV = () => {
    if (!filteredRegistrants?.length) return;
    const dynamicHeaders = new Set<string>();
    filteredRegistrants.forEach(r => Object.keys(r.registrationData || {}).forEach(k => dynamicHeaders.add(k)));
    const dynamicHeadersArray = Array.from(dynamicHeaders);

    const headers = ['Name', 'Email', 'Phone', 'Status', 'Registered At', 'Attended At', 'Personalized URL', ...dynamicHeadersArray];

    const csvContent = [
      headers.join(','),
      ...filteredRegistrants.map(r => {
        const row = [
          `"${r.name}"`,
          `"${r.email || ''}"`,
          `"${r.phone || ''}"`,
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

  if (isLoadingMeeting || isLoadingRegistrants) {
    return <div className="p-8"><Skeleton className="h-[500px] w-full rounded-2xl" /></div>;
  }

  if (meetingError || registrantsError) {
      const error = meetingError || registrantsError;
      return (
          <div className="p-8">
              <Alert variant="destructive" className="rounded-2xl border-none ring-1 ring-destructive/20 bg-destructive/5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="font-semibold text-[10px]">Database Error</AlertTitle>
                  <AlertDescription className="text-sm font-medium mt-1">
                      {error?.message || 'An error occurred while fetching data. Check your connection or permissions.'}
                  </AlertDescription>
                  <Button variant="outline" size="sm" className="mt-4 font-bold rounded-xl" onClick={() => window.location.reload()}>
                      Retry Connection
                  </Button>
              </Alert>
          </div>
      );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-8 text-left pb-24">
          
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground">
                        <Link href="/admin/meetings"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <Badge variant="outline" className="font-semibold uppercase text-[10px] bg-background">
                        {meeting?.type?.name || 'Meeting'}
                    </Badge>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight leading-none">{meeting?.entityName} Registrants</h1>
                <p className="text-sm font-medium text-muted-foreground mt-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> {meeting?.meetingTime ? format(new Date(meeting.meetingTime), 'PPPP') : 'Date TBD'}
                </p>
            </div>
            
            <div className="flex items-center gap-3">
                <Button variant="outline" className="font-bold gap-2 rounded-xl h-10" onClick={handleExportCSV} disabled={!filteredRegistrants.length}>
                    <Download className="h-4 w-4" /> Export CSV
                </Button>
                <Button className="font-bold gap-2 rounded-xl h-10" onClick={() => setIsRegisterOpen(true)}>
                    <Plus className="h-4 w-4" /> Add Registrant
                </Button>
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Total Registrants</p>
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
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Attended</p>
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
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Pending/No Show</p>
                            <p className="text-3xl font-semibold text-amber-600 dark:text-amber-500">{stats.pending}</p>
                        </div>
                        <div className="p-3 bg-amber-500/10 rounded-xl"><Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" /></div>
                    </div>
                </CardContent>
            </Card>
            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-background">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Attendance Rate</p>
                            <p className="text-3xl font-semibold">{stats.attendanceRate}%</p>
                        </div>
                        <div className="p-3 bg-violet-500/10 rounded-xl"><ClipboardCheck className="h-5 w-5 text-violet-600 dark:text-violet-500" /></div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Main Content */}
        <Card className="rounded-2xl border-none overflow-hidden ring-1 ring-border shadow-sm relative">
            {/* Bulk Toolbar overlay if selected */}
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
                    <CardTitle className="text-lg font-semibold tracking-tight">Registration Roster</CardTitle>
                    <CardDescription className="text-xs font-medium">Manage and review all signups for this session.</CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by name or email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 rounded-xl bg-background border-none ring-1 ring-border shadow-sm focus-visible:ring-primary"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0 bg-background">
                {!filteredRegistrants || filteredRegistrants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="p-4 bg-muted/20 rounded-full mb-4">
                            <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">No Registrants Found</h3>
                        <p className="text-xs font-medium text-muted-foreground mt-1 max-w-sm">
                            {searchQuery ? 'No registrants match your search criteria.' : 'There are currently no registrants for this session.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-background hover:bg-background">
                                    <TableHead className="w-[40px] pl-4">
                                      <Checkbox 
                                        checked={selectedIds.size === filteredRegistrants.length && filteredRegistrants.length > 0}
                                        onCheckedChange={toggleAll}
                                      />
                                    </TableHead>
                                    <TableHead className="text-[10px] font-semibold h-12">Name</TableHead>
                                    <TableHead className="text-[10px] font-semibold">Registered</TableHead>
                                    <TableHead className="text-[10px] font-semibold">Status</TableHead>
                                    <TableHead className="w-[150px] text-right text-[10px] font-semibold pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRegistrants.map((registrant) => (
                                    <TableRow key={registrant.id} className="group" data-state={selectedIds.has(registrant.id) ? "selected" : undefined}>
                                        <TableCell className="pl-4">
                                          <Checkbox 
                                            checked={selectedIds.has(registrant.id)}
                                            onCheckedChange={() => toggleOne(registrant.id)}
                                          />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{registrant.name}</span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Mail className="h-3 w-3" /> {registrant.email || 'N/A'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium text-muted-foreground">
                                            {registrant.registeredAt ? format(new Date(registrant.registeredAt), 'MMM d, h:mm a') : 'Unknown'}
                                        </TableCell>
                                        <TableCell>
                                            {registrant.status === 'attended' ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 font-bold uppercase tracking-wider text-[9px]">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Attended
                                                </Badge>
                                            ) : registrant.status === 'approved' ? (
                                                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20 font-bold uppercase tracking-wider text-[9px]">
                                                    <UserCheck className="h-3 w-3 mr-1" /> Approved
                                                </Badge>
                                            ) : registrant.status === 'cancelled' ? (
                                                <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 font-bold uppercase tracking-wider text-[9px]">
                                                    <X className="h-3 w-3 mr-1" /> Disapproved
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-muted text-muted-foreground font-bold uppercase tracking-wider text-[9px] transition-all">
                                                    <Clock className="h-3 w-3 mr-1" /> {registrant.status}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => toggleAttendance(registrant)}
                                                    disabled={isToggling[registrant.id]}
                                                    className={`h-8 text-xs font-bold transition-all ${
                                                        registrant.status === 'attended'
                                                            ? "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20" 
                                                            : "bg-primary/5 hover:bg-primary hover:text-white border-primary/20"
                                                    }`}
                                                >
                                                    {isToggling[registrant.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : registrant.status === 'attended' ? 'Revoke' : 'Mark Attended'}
                                                </Button>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(registrant, 'approved')}>
                                                            <Check className="h-4 w-4 mr-2" /> Approve
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleUpdateStatus(registrant, 'cancelled')}>
                                                            <X className="h-4 w-4 mr-2" /> Disapprove
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleSendLink(registrant)}>
                                                            <Send className="h-4 w-4 mr-2" /> Send Join Link
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem 
                                                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                            onClick={() => setRegistrantToDelete(registrant)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!registrantToDelete} onOpenChange={(open) => !open && setRegistrantToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <b>{registrantToDelete?.name}</b> from the registrant list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90 rounded-xl"
              onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual Registration Dialog */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-primary" />
                Add Registrant Manually
            </DialogTitle>
            <DialogDescription>
              Directly add a participant to this meeting. They will automatically be marked as approved.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualRegister} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                placeholder="John Doe" 
                required 
                value={regForm.name}
                onChange={e => setRegForm({...regForm, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="john@example.com" 
                required 
                value={regForm.email}
                onChange={e => setRegForm({...regForm, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="+1 234 567 8900" 
                value={regForm.phone}
                onChange={e => setRegForm({...regForm, phone: e.target.value})}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isRegistering} className="rounded-xl">
                {isRegistering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Register Participant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

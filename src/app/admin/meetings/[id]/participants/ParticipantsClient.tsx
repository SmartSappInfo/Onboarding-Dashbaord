'use client';

/**
 * @fileoverview Unified Participant Roster & Live Attendance Studio in SmartSapp Meetings 2.0.
 * Multi-role participant management (Hosts, Facilitators, Panelists, Attendees, Guests),
 * real-time attendance check-in/check-out, RSVP tracking, role assignment, and CSV export.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Strictly typed. Zero 'any' or 'any[]'.
 * - Touch targets must maintain min-h-[44px] on mobile devices.
 */

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Download,
  RefreshCw,
  Mail,
  Phone,
  Shield,
  Loader2,
  Trash2,
  Check,
  UserCheck,
  UserX,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import type {
  MeetingParticipant,
  ParticipantRole,
  ParticipantRsvpStatus,
  ParticipantAttendanceStatus,
} from '@/lib/meetings/types';
import {
  getParticipantRoleMeta,
  formatAttendanceDuration,
} from '@/lib/meetings/participant-service';
import {
  addMeetingParticipantAction,
  updateParticipantRoleAction,
  updateParticipantRsvpAction,
  toggleParticipantAttendanceAction,
  removeParticipantAction,
} from '@/app/actions/meeting-participant-actions';
import { migrateMeetingToUnifiedSchemaAction } from '@/app/actions/meeting-migration-actions';
import { cn } from '@/lib/utils';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

interface ParticipantsClientProps {
  meetingId: string;
  meetingTitle: string;
}

export default function ParticipantsClient({ meetingId, meetingTitle }: ParticipantsClientProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  const [attendanceFilter, setAttendanceFilter] = React.useState<string>('all');
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isMigrating, setIsMigrating] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  // Add Participant Form State
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [newRole, setNewRole] = React.useState<ParticipantRole>('attendee');
  const [sendInvite, setSendInvite] = React.useState(true);
  const [isSubmittingAdd, setIsSubmittingAdd] = React.useState(false);

  // Realtime query for participants subcollection
  const participantsQuery = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return query(
      collection(firestore, `meetings/${meetingId}/participants`),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, meetingId]);

  const { data: participants, isLoading } = useCollection<MeetingParticipant>(participantsQuery);

  // Filtered participants list
  const filteredParticipants = React.useMemo(() => {
    if (!participants) return [];
    return participants.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone && p.phone.includes(searchQuery));

      const matchesRole =
        roleFilter === 'all'
          ? true
          : roleFilter === 'hosts_facilitators'
          ? p.role === 'host' || p.role === 'co_host' || p.role === 'facilitator'
          : p.role === roleFilter;

      const matchesAttendance =
        attendanceFilter === 'all'
          ? true
          : p.attendanceStatus === attendanceFilter;

      return matchesSearch && matchesRole && matchesAttendance;
    });
  }, [participants, searchQuery, roleFilter, attendanceFilter]);

  // Summary Metrics
  const metrics = React.useMemo(() => {
    if (!participants) return { total: 0, joined: 0, accepted: 0, hosts: 0 };
    return {
      total: participants.length,
      joined: participants.filter(p => p.attendanceStatus === 'joined').length,
      accepted: participants.filter(p => p.rsvpStatus === 'accepted').length,
      hosts: participants.filter(p => p.role === 'host' || p.role === 'co_host' || p.role === 'facilitator').length,
    };
  }, [participants]);

  // Handle Add Participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      toast({ variant: 'destructive', title: 'Missing required fields', description: 'Name and email are required.' });
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await addMeetingParticipantAction({
        meetingId,
        workspaceId: activeWorkspaceId || 'default',
        organizationId: activeOrganizationId || undefined,
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || undefined,
        role: newRole,
        sendInviteEmail: sendInvite,
      });

      if (res.success) {
        toast({ title: 'Participant Added', description: `${newName} has been added as ${newRole}.` });
        setIsAddOpen(false);
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewRole('attendee');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Toggle Attendance (Live Check-In / Check-Out)
  const handleToggleAttendance = async (p: MeetingParticipant) => {
    setActionLoadingId(p.id);
    try {
      const res = await toggleParticipantAttendanceAction({
        meetingId,
        participantId: p.id,
      });

      if (res.success) {
        toast({
          title: res.newStatus === 'joined' ? 'Checked In' : 'Checked Out',
          description: `${p.name} marked as ${res.newStatus === 'joined' ? 'present' : 'left'}.`,
        });
      } else {
        toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Role Change
  const handleChangeRole = async (participantId: string, role: ParticipantRole) => {
    setActionLoadingId(participantId);
    try {
      const res = await updateParticipantRoleAction({
        meetingId,
        participantId,
        newRole: role,
      });
      if (res.success) {
        toast({ title: 'Role Updated', description: `Participant role updated to ${role}.` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle RSVP Update
  const handleChangeRsvp = async (participantId: string, rsvp: ParticipantRsvpStatus) => {
    setActionLoadingId(participantId);
    try {
      const res = await updateParticipantRsvpAction({
        meetingId,
        participantId,
        newRsvp: rsvp,
      });
      if (res.success) {
        toast({ title: 'RSVP Updated', description: `RSVP marked as ${rsvp}.` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Delete
  const handleDelete = async (p: MeetingParticipant) => {
    const ok = await confirm({
      title: 'Remove Participant?',
      description: `Are you sure you want to remove ${p.name} from this meeting?`,
      confirmText: 'Remove',
      variant: 'destructive',
    });

    if (!ok) return;

    setActionLoadingId(p.id);
    try {
      const res = await removeParticipantAction({
        meetingId,
        participantId: p.id,
      });
      if (res.success) {
        toast({ title: 'Participant Removed' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setActionLoadingId(null);
    }
  };

  // One-click Migrate / Sync Legacy Records
  const handleMigrateLegacy = async () => {
    setIsMigrating(true);
    try {
      const res = await migrateMeetingToUnifiedSchemaAction(meetingId);
      if (res.success && res.summary) {
        toast({
          title: 'Sync Complete',
          description: `Migrated ${res.summary.participantsCreated} legacy records to unified schema.`,
        });
      } else {
        toast({ variant: 'destructive', title: 'Sync Failed', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsMigrating(false);
    }
  };

  // Export Roster to CSV
  const handleExportCSV = () => {
    if (!filteredParticipants || filteredParticipants.length === 0) {
      toast({ variant: 'destructive', title: 'Export Empty', description: 'No participant data to export.' });
      return;
    }

    const headers = ['Name', 'Email', 'Phone', 'Role', 'RSVP Status', 'Attendance Status', 'Duration (Seconds)', 'Created At'];
    const rows = filteredParticipants.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.email}"`,
      `"${p.phone || ''}"`,
      `"${p.role}"`,
      `"${p.rsvpStatus}"`,
      `"${p.attendanceStatus}"`,
      p.totalAttendanceSeconds || 0,
      `"${p.createdAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting-participants-${meetingId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Started', description: 'Participant roster exported to CSV.' });
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Participant Roster</h2>
          <p className="text-sm text-muted-foreground">
            Manage hosts, facilitators, and attendees with live check-in and attendance duration tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMigrateLegacy}
            disabled={isMigrating}
            className="rounded-xl min-h-[44px] text-xs gap-1.5 active:scale-[0.97]"
            title="Sync legacy registrants & facilitators into unified participants"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
            Sync Legacy
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl min-h-[44px] text-xs gap-1.5 active:scale-[0.97]"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="rounded-xl min-h-[44px] text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-[0.97]"
          >
            <UserPlus className="w-4 h-4" />
            Add Participant
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Total Roster</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{metrics.total}</p>
        </Card>
        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Hosts & Facilitators</p>
          <p className="text-2xl font-bold mt-1 text-primary">{metrics.hosts}</p>
        </Card>
        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Confirmed / Accepted</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{metrics.accepted}</p>
        </Card>
        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <p className="text-xs text-muted-foreground font-medium">Live Checked-In</p>
          <p className="text-2xl font-bold mt-1 text-sky-600 dark:text-sky-400">{metrics.joined}</p>
        </Card>
      </div>

      {/* Search & Filter Controls */}
      <Card className="rounded-2xl border-border bg-card shadow-xs p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="pl-9 rounded-xl min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44 rounded-xl min-h-[44px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="hosts_facilitators">Hosts & Facilitators</SelectItem>
                <SelectItem value="host">Host</SelectItem>
                <SelectItem value="facilitator">Facilitator</SelectItem>
                <SelectItem value="attendee">Attendee</SelectItem>
                <SelectItem value="panelist">Panelist</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>

            <Select value={attendanceFilter} onValueChange={setAttendanceFilter}>
              <SelectTrigger className="w-44 rounded-xl min-h-[44px]">
                <SelectValue placeholder="All Attendance" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Attendance</SelectItem>
                <SelectItem value="joined">Checked In (Active)</SelectItem>
                <SelectItem value="not_joined">Not Joined</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Participant Roster Table */}
      <Card className="rounded-2xl border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Participant</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">RSVP</th>
                <th className="py-3 px-4">Live Attendance</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading participant roster...
                  </td>
                </tr>
              ) : filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No participants match the current criteria.</p>
                    <p className="text-xs mt-1">Add attendees or click "Sync Legacy" to backfill existing registrants.</p>
                  </td>
                </tr>
              ) : (
                filteredParticipants.map(p => {
                  const roleMeta = getParticipantRoleMeta(p.role);
                  const isCheckedIn = p.attendanceStatus === 'joined';

                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors group">
                      {/* Name & Contact */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {p.email}
                          </span>
                          {p.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {p.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={cn('text-xs font-semibold px-2 py-0.5 rounded-md', roleMeta.badgeClass)}>
                          {roleMeta.label}
                        </Badge>
                      </td>

                      {/* RSVP */}
                      <td className="py-3 px-4">
                        {p.rsvpStatus === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                          </span>
                        ) : p.rsvpStatus === 'declined' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                            <XCircle className="w-3.5 h-3.5" /> Declined
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </td>

                      {/* Attendance Status & Live Check-In Toggle */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant={isCheckedIn ? 'default' : 'outline'}
                            size="sm"
                            disabled={actionLoadingId === p.id}
                            onClick={() => handleToggleAttendance(p)}
                            className={cn(
                              'rounded-xl text-xs h-8 px-3 gap-1.5 transition-all active:scale-[0.97]',
                              isCheckedIn
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'hover:bg-muted text-muted-foreground'
                            )}
                          >
                            {actionLoadingId === p.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isCheckedIn ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Checked In</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Check In</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {formatAttendanceDuration(p.totalAttendanceSeconds || 0)}
                      </td>

                      {/* Actions Menu */}
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg active:scale-[0.97]">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl">
                            <DropdownMenuLabel className="text-xs">Change Role</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleChangeRole(p.id, 'host')}>
                              Promote to Host
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeRole(p.id, 'facilitator')}>
                              Set as Facilitator
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeRole(p.id, 'panelist')}>
                              Set as Panelist
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeRole(p.id, 'attendee')}>
                              Set as Attendee
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuLabel className="text-xs">RSVP Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleChangeRsvp(p.id, 'accepted')}>
                              Mark Accepted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeRsvp(p.id, 'declined')}>
                              Mark Declined
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleChangeRsvp(p.id, 'tentative')}>
                              Mark Tentative
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => handleDelete(p)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Remove Participant
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Participant Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
            <DialogDescription>
              Add a host, facilitator, or attendee to {meetingTitle}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddParticipant} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="participant-name" className="text-xs font-semibold">Full Name *</Label>
              <Input
                id="participant-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. John Doe"
                className="rounded-xl min-h-[44px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="participant-email" className="text-xs font-semibold">Email Address *</Label>
              <Input
                id="participant-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="john@example.com"
                className="rounded-xl min-h-[44px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="participant-phone" className="text-xs font-semibold">Phone Number (Optional)</Label>
              <Input
                id="participant-phone"
                type="tel"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="+1 555 0199"
                className="rounded-xl min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Participant Role</Label>
              <Select value={newRole} onValueChange={(val: ParticipantRole) => setNewRole(val)}>
                <SelectTrigger className="rounded-xl min-h-[44px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="attendee">Attendee</SelectItem>
                  <SelectItem value="facilitator">Facilitator</SelectItem>
                  <SelectItem value="host">Host</SelectItem>
                  <SelectItem value="co_host">Co-Host</SelectItem>
                  <SelectItem value="panelist">Panelist</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="send-invite-check"
                checked={sendInvite}
                onCheckedChange={c => setSendInvite(!!c)}
              />
              <label htmlFor="send-invite-check" className="text-xs font-medium cursor-pointer">
                Send email invitation with calendar (.ics) attachment
              </label>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingAdd}
                className="rounded-xl min-h-[44px] px-6 active:scale-[0.97]"
              >
                {isSubmittingAdd ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Participant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

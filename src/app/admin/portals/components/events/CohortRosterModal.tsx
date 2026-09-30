'use client';

/**
 * {{Org_name}} Experience Platform — Cohort Roster & Student Manager Modal
 *
 * Backoffice inspector for Course Cohorts.
 * Roster table with student progress, active/graduated status,
 * 1-click student enrollment, student removal, and community space integration.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  enrollCohortMemberAction,
  removeCohortMemberAction,
} from '@/app/actions/event-actions';
import type { CourseCohort, CohortMember, CohortMemberStatus } from '@/lib/types/events';
import { getErrorMessage } from '@/lib/errors/report-error';
import {
  GraduationCap,
  Users,
  UserPlus,
  Trash2,
  MessagesSquare,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

interface CohortRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  cohort: CourseCohort | null;
  portalId: string;
  portalSlug: string;
}

export function CohortRosterModal({
  isOpen,
  onClose,
  cohort,
  portalId,
  portalSlug,
}: CohortRosterModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isAddMemberOpen, setIsAddMemberOpen] = React.useState(false);
  const [newStudentName, setNewStudentName] = React.useState('');
  const [newStudentEmail, setNewStudentEmail] = React.useState('');
  const [newStudentUserId, setNewStudentUserId] = React.useState('');
  const [isEnrolling, setIsEnrolling] = React.useState(false);
  const [removingUserId, setRemovingUserId] = React.useState<string | null>(null);

  // Query cohort members. The organizationId filter is what lets the Firestore rule prove the
  // roster stays inside the staff member's organization; without it the query is rejected.
  const membersQuery = useMemoFirebase(
    () =>
      firestore && cohort?.id && cohort.organizationId
        ? query(
            collection(firestore, 'cohort_members'),
            where('organizationId', '==', cohort.organizationId),
            where('cohortId', '==', cohort.id),
            orderBy('joinedAt', 'desc')
          )
        : null,
    [firestore, cohort?.id, cohort?.organizationId]
  );

  const { data: members, isLoading } = useCollection<CohortMember>(membersQuery);

  const handleEnrollMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohort || !newStudentEmail.trim() || !newStudentName.trim()) {
      toast({ title: 'Missing Info', description: 'Name and email are required.' });
      return;
    }

    const userId = newStudentUserId.trim() || `usr_${newStudentEmail.trim().replace(/[^a-z0-9]/gi, '_')}`;

    setIsEnrolling(true);
    try {
      const res = await enrollCohortMemberAction(
        {
          cohortId: cohort.id,
          courseId: cohort.courseId || 'all',
          portalId,
          organizationId: cohort.organizationId,
          userId,
          userName: newStudentName.trim(),
          userEmail: newStudentEmail.trim(),
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({
        title: 'Student Enrolled! 🎓',
        description: `Added "${newStudentName}" to ${cohort.name}.`,
      });

      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentUserId('');
      setIsAddMemberOpen(false);
    } catch (err: unknown) {
      toast({
        title: 'Enrollment Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRemoveMember = async (member: CohortMember) => {
    if (!cohort) return;
    if (!confirm(`Are you sure you want to remove ${member.userName} from this cohort?`)) return;

    setRemovingUserId(member.userId);
    try {
      const res = await removeCohortMemberAction(cohort.id, member.userId, portalId, portalSlug);
      if (!res.success) throw new Error(res.error);
      toast({
        title: 'Student Removed',
        description: `${member.userName} was removed from the cohort roster.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Removal Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setRemovingUserId(null);
    }
  };

  const getStatusBadge = (status: CohortMemberStatus) => {
    switch (status) {
      case 'graduated':
        return (
          <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1 px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> Graduated
          </Badge>
        );
      case 'dropped':
        return (
          <Badge variant="outline" className="text-muted-foreground border-border text-[10px] font-bold px-2 py-0.5">
            Dropped
          </Badge>
        );
      default:
        return (
          <Badge className="bg-primary text-white font-bold text-[10px] px-2 py-0.5">
            Active
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl p-6 rounded-3xl border-2 border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 border-b border-border pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <DialogTitle className="font-extrabold text-xl text-foreground flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" /> Cohort Student Roster
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {cohort?.name || 'Cohort'} • {cohort?.enrolledCount || 0}
                {cohort?.maxCapacity ? ` / ${cohort.maxCapacity}` : ''} Enrolled
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              {cohort?.linkedSpaceId && (
                <Button asChild variant="outline" size="sm" className="min-h-[44px] rounded-xl font-bold text-xs gap-1.5">
                  <Link href={`/portal/${portalSlug}/community/${cohort.linkedSpaceId}`} target="_blank">
                    <MessagesSquare className="w-3.5 h-3.5 text-primary" /> Open Community Space
                  </Link>
                </Button>
              )}

              <Button
                onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}
                size="sm"
                className="min-h-[44px] rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 active:scale-[0.97] shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" /> Enroll Student
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Add Student Collapsible Form */}
        {isAddMemberOpen && (
          <form
            onSubmit={handleEnrollMember}
            className="p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-200"
          >
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary">
              Enroll Student into {cohort?.name}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold">Student Name *</Label>
                <Input
                  required
                  placeholder="e.g. Alex Johnson"
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  className="h-10 min-h-[40px] text-xs rounded-xl bg-card border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold">Student Email *</Label>
                <Input
                  required
                  type="email"
                  placeholder="alex@example.com"
                  value={newStudentEmail}
                  onChange={e => setNewStudentEmail(e.target.value)}
                  className="h-10 min-h-[40px] text-xs rounded-xl bg-card border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold">User ID (Optional)</Label>
                <Input
                  placeholder="Leave blank to auto-generate"
                  value={newStudentUserId}
                  onChange={e => setNewStudentUserId(e.target.value)}
                  className="h-10 min-h-[40px] text-xs rounded-xl bg-card border-border"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddMemberOpen(false)}
                className="min-h-[40px] rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isEnrolling}
                className="min-h-[40px] rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 active:scale-[0.97]"
              >
                {isEnrolling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Enrollment'}
              </Button>
            </div>
          </form>
        )}

        {/* Cohort Timeline Strip */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">
              {cohort?.startDate ? new Date(cohort.startDate).toLocaleDateString() : 'TBD'}
            </span>
            <span>–</span>
            <span className="font-semibold text-foreground">
              {cohort?.endDate ? new Date(cohort.endDate).toLocaleDateString() : 'TBD'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" />
            <span>Capacity: {cohort?.enrolledCount || 0} / {cohort?.maxCapacity || 'Unlimited'}</span>
          </div>
        </div>

        {/* Member Table */}
        <div className="pt-2">
          {isLoading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : !members || members.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10 space-y-2">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/60" />
              <h4 className="font-bold text-sm text-foreground">No Enrolled Students Yet</h4>
              <p className="text-xs text-muted-foreground">
                Add students above or allow them to enroll during checkout or registration.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Student</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                    <TableHead className="font-bold text-xs">Course Progress</TableHead>
                    <TableHead className="font-bold text-xs">Joined</TableHead>
                    <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(member => {
                    const isRemoving = removingUserId === member.userId;
                    const progress = member.progressPercentage || 0;

                    return (
                      <TableRow key={member.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-8 h-8 border border-border">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                {member.userName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                              <p className="font-bold text-xs text-foreground">{member.userName}</p>
                              <p className="text-[10px] text-muted-foreground">{member.userEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(member.status)}</TableCell>
                        <TableCell>
                          <div className="w-32 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                              <span>{progress}%</span>
                              <span>{member.completedLessonCount || 0} lessons</span>
                            </div>
                            <Progress value={progress} className="h-1.5 rounded-full" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isRemoving}
                            onClick={() => handleRemoveMember(member)}
                            className="h-8 w-8 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 active:scale-[0.95]"
                            title="Remove student from cohort"
                          >
                            {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

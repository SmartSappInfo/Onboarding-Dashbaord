'use client';

/**
 * {{Org_name}} Experience Platform — Portal Member Manager
 *
 * Comprehensive administrative studio tab for managing Members,
 * Invitations, Pricing Tiers, and Entitlements inside the Portal Configurator.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Shield,
  CreditCard,
  Link2,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Award,
  Copy,
  Trash2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { InviteMemberModal } from './InviteMemberModal';
import { MembershipPlanManager } from './MembershipPlanManager';
import { AccessGrantAuditor } from './AccessGrantAuditor';
import {
  updateMembershipRoleAction,
  suspendMembershipAction,
  reactivateMembershipAction,
  deleteMembershipAction,
  revokeInvitationAction,
  listMembershipsByPortalAction,
  listInvitationsByPortalAction,
  listPlansByPortalAction,
} from '@/app/actions/membership-actions';
import type {
  PortalMembership,
  PortalInvitation,
  MembershipPlan,
  PortalMemberRole,
} from '@/lib/types/membership';

interface PortalMemberManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds: string[];
}

export function PortalMemberManager({
  portalId,
  portalSlug,
  organizationId,
  workspaceIds,
}: PortalMemberManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeSubTab, setActiveSubTab] = React.useState('members');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState<string>('all');
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);

  // Server Action Fallbacks
  const [serverMembers, setServerMembers] = React.useState<PortalMembership[]>([]);
  const [serverInvitations, setServerInvitations] = React.useState<PortalInvitation[]>([]);
  const [serverPlans, setServerPlans] = React.useState<MembershipPlan[]>([]);
  const [isLoadingServer, setIsLoadingServer] = React.useState(true);

  const fetchServerData = React.useCallback(async () => {
    if (!portalId) return;
    try {
      setIsLoadingServer(true);
      const [membersRes, invitesRes, plansRes] = await Promise.all([
        listMembershipsByPortalAction(portalId),
        listInvitationsByPortalAction(portalId),
        listPlansByPortalAction(portalId),
      ]);
      if (membersRes.success && membersRes.data) setServerMembers(membersRes.data);
      if (invitesRes.success && invitesRes.data) setServerInvitations(invitesRes.data);
      if (plansRes.success && plansRes.data) setServerPlans(plansRes.data);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingServer(false);
    }
  }, [portalId]);

  React.useEffect(() => {
    fetchServerData();
  }, [fetchServerData]);

  // 1. Members Query (realtime sync when available)
  const membersQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'portal_memberships'),
            where('portalId', '==', portalId),
            orderBy('joinedAt', 'desc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: members, isLoading: isLoadingMembers } = useCollection<PortalMembership>(membersQuery);

  // 2. Invitations Query
  const invitationsQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'portal_invitations'),
            where('portalId', '==', portalId),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: invitations, isLoading: isLoadingInvitations } = useCollection<PortalInvitation>(invitationsQuery);

  // 3. Plans Query
  const plansQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'membership_plans'),
            where('portalId', '==', portalId),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: plans } = useCollection<MembershipPlan>(plansQuery);

  const effectiveMembers = (members && members.length > 0) ? members : serverMembers;
  const effectiveInvitations = (invitations && invitations.length > 0) ? invitations : serverInvitations;
  const effectivePlans = (plans && plans.length > 0) ? plans : serverPlans;

  // Filtered Members
  const filteredMembers = React.useMemo(() => {
    return effectiveMembers.filter(m => {
      const matchesSearch =
        m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesRole = selectedRole === 'all' || m.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [effectiveMembers, searchTerm, selectedRole]);

  // Actions
  const handleRoleChange = async (member: PortalMembership, newRole: PortalMemberRole) => {
    try {
      const res = await updateMembershipRoleAction(member.id, newRole, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to update role.');
      toast({ title: 'Role Updated', description: `${member.displayName} is now a ${newRole}.` });
      fetchServerData();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Role change failed.' });
    }
  };

  const handleSuspend = async (member: PortalMembership) => {
    try {
      const res = await suspendMembershipAction(member.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to suspend member.');
      toast({ title: 'Member Suspended', description: `${member.displayName}'s access was suspended.` });
      fetchServerData();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Suspension failed.' });
    }
  };

  const handleReactivate = async (member: PortalMembership) => {
    try {
      const res = await reactivateMembershipAction(member.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to reactivate member.');
      toast({ title: 'Member Reactivated', description: `${member.displayName}'s access was restored.` });
      fetchServerData();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Reactivation failed.' });
    }
  };

  const handleDelete = async (member: PortalMembership) => {
    if (!confirm(`Delete membership for ${member.displayName}? This will remove all progress.`)) return;
    try {
      const res = await deleteMembershipAction(member.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to delete member.');
      toast({ title: 'Member Removed', description: `${member.displayName} removed from portal.` });
      fetchServerData();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Delete failed.' });
    }
  };

  const handleRevokeInvitation = async (invitation: PortalInvitation) => {
    try {
      const res = await revokeInvitationAction(invitation.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to revoke invite.');
      toast({ title: 'Invite Revoked', description: 'Invitation is no longer valid.' });
      fetchServerData();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Revoke failed.' });
    }
  };

  const handleCopyInviteLink = (token: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/portal/${portalSlug}/join?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link Copied', description: 'Join link copied to clipboard.' });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Users className="w-4 h-4" /> Membership & Entitlements Hub
              </div>
            </div>

            <Button
              onClick={() => setIsInviteModalOpen(true)}
              className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm self-start md:self-auto"
            >
              <UserPlus className="w-4 h-4" /> Onboard & Invite Members
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
            <TabsList className="w-full h-11 p-1 bg-muted/60 rounded-xl grid grid-cols-4">
              <TabsTrigger value="members" className="rounded-lg text-xs font-bold gap-1.5">
                <Users className="w-3.5 h-3.5" /> Members ({effectiveMembers.length})
              </TabsTrigger>
              <TabsTrigger value="invitations" className="rounded-lg text-xs font-bold gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Invites ({effectiveInvitations.length})
              </TabsTrigger>
              <TabsTrigger value="plans" className="rounded-lg text-xs font-bold gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Tiers & Plans ({effectivePlans.length})
              </TabsTrigger>
              <TabsTrigger value="grants" className="rounded-lg text-xs font-bold gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Entitlement Grants
              </TabsTrigger>
            </TabsList>

            {/* ── Sub-Tab 1: Member Directory ──────────────────────────── */}
            <TabsContent value="members" className="space-y-4 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or tags..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 rounded-xl text-xs bg-background"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {['all', 'member', 'student', 'instructor', 'moderator', 'admin'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 capitalize ${
                        selectedRole === r
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-card text-muted-foreground border border-border hover:border-primary/40'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingMembers ? (
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed rounded-2xl space-y-2 bg-muted/20">
                  <Users className="w-8 h-8 mx-auto text-primary" />
                  <h5 className="font-bold text-xs text-foreground">No Members Found</h5>
                  <p className="text-xs text-muted-foreground">
                    {searchTerm ? 'Try a different search keyword.' : 'Invite students and staff to populate this portal.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {filteredMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/20 transition-all shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar className="w-10 h-10 border border-border">
                          {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.displayName} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {member.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-xs text-foreground truncate max-w-xs">
                              {member.displayName}
                            </h5>
                            <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0 capitalize">
                              {member.role}
                            </Badge>
                            <Badge
                              variant={member.status === 'active' ? 'default' : 'secondary'}
                              className="text-[9px] uppercase font-bold px-1.5 py-0"
                            >
                              {member.status}
                            </Badge>
                            {member.planName && (
                              <Badge variant="secondary" className="text-[9px] font-medium px-1.5 py-0">
                                {member.planName}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{member.email}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-amber-500 font-bold">
                              <Sparkles className="w-3 h-3" /> {member.points} pts
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-rose-500 font-bold">
                              <Flame className="w-3 h-3" /> {member.streakDays}d streak
                            </span>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                          <DropdownMenuItem onClick={() => handleRoleChange(member, 'student')} className="text-xs font-semibold">
                            Set as Student
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(member, 'instructor')} className="text-xs font-semibold">
                            Set as Instructor
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(member, 'moderator')} className="text-xs font-semibold">
                            Set as Moderator
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRoleChange(member, 'admin')} className="text-xs font-semibold">
                            Promote to Portal Admin
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {member.status === 'active' ? (
                            <DropdownMenuItem onClick={() => handleSuspend(member)} className="text-xs font-semibold text-amber-600">
                              Suspend Access
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleReactivate(member)} className="text-xs font-semibold text-emerald-600">
                              Reactivate Access
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(member)} className="text-xs font-semibold text-rose-500">
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Sub-Tab 2: Invitations & Links ───────────────────────── */}
            <TabsContent value="invitations" className="space-y-4 pt-4">
              {isLoadingInvitations && effectiveInvitations.length === 0 ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              ) : effectiveInvitations.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-2xl space-y-2 bg-muted/20">
                  <Link2 className="w-8 h-8 mx-auto text-primary" />
                  <h5 className="font-bold text-xs text-foreground">No Pending Invitations</h5>
                  <p className="text-xs text-muted-foreground">Generate invitation links to onboard members.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {effectiveInvitations.map(inv => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground font-mono">
                            {inv.email || 'Multi-Use Shareable Link'}
                          </span>
                          <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0 capitalize">
                            {inv.role}
                          </Badge>
                          <Badge
                            variant={inv.status === 'pending' ? 'default' : 'secondary'}
                            className="text-[9px] uppercase font-bold px-1.5 py-0"
                          >
                            {inv.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Uses: <strong className="text-foreground">{inv.usedCount} / {inv.maxUses}</strong> •
                          Expires: {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'Never'}
                          {inv.note && ` • Note: ${inv.note}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyInviteLink(inv.token)}
                          title="Copy Link"
                          className="h-8 w-8 rounded-lg text-primary"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {inv.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeInvitation(inv)}
                            title="Revoke Link"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Sub-Tab 3: Membership Tiers & Plans ───────────────────── */}
            <TabsContent value="plans" className="pt-4">
              <MembershipPlanManager
                portalId={portalId}
                organizationId={organizationId}
                workspaceIds={workspaceIds}
                plans={effectivePlans}
              />
            </TabsContent>

            {/* ── Sub-Tab 4: Entitlement Grants ─────────────────────────── */}
            <TabsContent value="grants" className="pt-4">
              <AccessGrantAuditor
                portalId={portalId}
                organizationId={organizationId}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Invite Member Wizard Modal */}
      <InviteMemberModal
        open={isInviteModalOpen}
        onOpenChange={(isOpen) => {
          setIsInviteModalOpen(isOpen);
          if (!isOpen) fetchServerData();
        }}
        portalId={portalId}
        portalSlug={portalSlug}
        organizationId={organizationId}
        workspaceIds={workspaceIds}
        plans={effectivePlans}
      />
    </div>
  );
}
